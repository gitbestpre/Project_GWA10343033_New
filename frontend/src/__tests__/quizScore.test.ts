/**
 * 计分口径单测（负责人 2026-09-20：「单选每题做对 6 分，多选做对 5 分」）。
 *
 * 覆盖四件事：
 *   1. 分值口径 —— 单选 6 / 多选 5；满分必须正好 100（5×6 + 14×5）；
 *   2. 累加计分 —— 答对加分、答错不加分；
 *   3. **每题只做一次** —— recordAnswer 幂等，重复调用不重复计分；
 *   4. 重置 —— resetQuizScore 清空记录与得分（新一次训练开始）。
 *
 * 注意：被测模块在 import 时就从 sessionStorage 恢复存档，故每个用例前都要
 * 清掉存储并重置状态，否则用例之间会互相污染（本项目在 moduleProgress 上踩过这类坑）。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  MAX_SCORE,
  POINTS,
  getAnsweredCount,
  getRecord,
  getScore,
  pointsOf,
  recordAnswer,
  resetQuizScore,
} from '../lib/quizScore'
import { QUESTIONS, getQuestionById } from '../data/questions'

const KEY = 'gwa10343033.quiz-score.v1'

/** 找一个单选/多选样例题，避免把题号写死在断言里（题库改动时用例仍成立） */
const singleQ = QUESTIONS.find((q) => q.type === 'single')!
const multipleQ = QUESTIONS.find((q) => q.type === 'multiple')!

beforeEach(() => {
  // resetQuizScore 只清内存态 + 存档，故直接调用即可回到干净起点
  resetQuizScore()
  window.sessionStorage.removeItem(KEY)
})

describe('quizScore 分值口径', () => {
  it('单选 6 分、多选 5 分', () => {
    expect(POINTS.single).toBe(6)
    expect(POINTS.multiple).toBe(5)
  })

  it('满分正好 100 分（5 道单选 × 6 + 14 道多选 × 5）', () => {
    const singles = QUESTIONS.filter((q) => q.type === 'single').length
    const multiples = QUESTIONS.filter((q) => q.type === 'multiple').length

    expect(singles).toBe(5)
    expect(multiples).toBe(14)
    expect(singles * POINTS.single + multiples * POINTS.multiple).toBe(100)
    expect(MAX_SCORE).toBe(100)
  })

  it('pointsOf 按题型给分；题库缺题时给 0 而不抛错', () => {
    expect(pointsOf(singleQ)).toBe(6)
    expect(pointsOf(multipleQ)).toBe(5)
    expect(pointsOf(undefined)).toBe(0)
  })
})

describe('quizScore 累加计分', () => {
  it('初始 0 分、0 题已答', () => {
    expect(getScore()).toBe(0)
    expect(getAnsweredCount()).toBe(0)
  })

  it('单选答对 +6', () => {
    recordAnswer(singleQ.id, singleQ.answerKeys, true)
    expect(getScore()).toBe(6)
  })

  it('多选答对 +5', () => {
    recordAnswer(multipleQ.id, multipleQ.answerKeys, true)
    expect(getScore()).toBe(5)
  })

  it('答错不加分，但计入已答题数（每题只做一次，不能靠重答刷分）', () => {
    recordAnswer(singleQ.id, [], false)
    expect(getScore()).toBe(0)
    expect(getAnsweredCount()).toBe(1)
  })

  it('得分是记录派生值：全部答对即满分 100', () => {
    for (const q of QUESTIONS) recordAnswer(q.id, q.answerKeys, true)
    expect(getScore()).toBe(MAX_SCORE)
    expect(getAnsweredCount()).toBe(QUESTIONS.length)
  })
})

describe('quizScore 每题只做一次', () => {
  it('重复作答同一题不覆盖记录、不重复计分', () => {
    expect(recordAnswer(singleQ.id, [], false)).toBe('new')
    expect(getScore()).toBe(0)

    // 第二次用正确答案再答一遍 —— 必须被拒（否则学员可反复重答刷分）
    expect(recordAnswer(singleQ.id, singleQ.answerKeys, true)).toBe('exists')
    expect(getScore()).toBe(0)

    // 原记录保持不变（仍是那次错误的作答）
    expect(getRecord(singleQ.id)?.correct).toBe(false)
    expect(getRecord(singleQ.id)?.selected).toEqual([])
  })

  it('同一题连答 5 次，得分与已答数都只算一次', () => {
    for (let i = 0; i < 5; i += 1) {
      recordAnswer(singleQ.id, singleQ.answerKeys, true)
    }
    expect(getScore()).toBe(6)
    expect(getAnsweredCount()).toBe(1)
  })

  it('记录里保存的是用户所选项（评审态回显的依据）', () => {
    const picked = multipleQ.answerKeys.slice(0, 1)
    recordAnswer(multipleQ.id, picked, false)
    expect(getRecord(multipleQ.id)?.selected).toEqual(picked)
    expect(getRecord(multipleQ.id)?.correct).toBe(false)
  })
})

describe('quizScore 重置与持久化', () => {
  it('resetQuizScore 清空记录与得分', () => {
    recordAnswer(singleQ.id, singleQ.answerKeys, true)
    recordAnswer(multipleQ.id, multipleQ.answerKeys, true)
    expect(getScore()).toBe(11)

    resetQuizScore()
    expect(getScore()).toBe(0)
    expect(getAnsweredCount()).toBe(0)
    expect(getRecord(singleQ.id)).toBeUndefined()
  })

  it('作答写入 sessionStorage（刷新后得分可延续）', () => {
    recordAnswer(singleQ.id, singleQ.answerKeys, true)
    const raw = window.sessionStorage.getItem(KEY)
    expect(raw).toBeTruthy()

    const parsed = JSON.parse(raw as string) as Record<string, { correct: boolean }>
    expect(parsed[singleQ.id]?.correct).toBe(true)
  })

  it('存储损坏时按「还没答过题」处理，不因脏数据崩掉', () => {
    window.sessionStorage.setItem(KEY, '{ 这不是合法 JSON')
    // 清内存态后重新读一次存档不应抛错；getScore 仍可安全调用
    resetQuizScore()
    expect(() => getScore()).not.toThrow()
    expect(getScore()).toBe(0)
  })
})

describe('quizScore 与题库一致性（防「算了不存在的题」）', () => {
  it('记录里的题号都能在题库中查到，故分值可推导', () => {
    for (const q of QUESTIONS) {
      expect(getQuestionById(q.id)?.id).toBe(q.id)
      expect(pointsOf(getQuestionById(q.id))).toBeGreaterThan(0)
    }
  })

  it('题库里不存在 H_13~H_16（id 从 H_12 直接跳到 H_17）', () => {
    for (const id of ['H_13', 'H_14', 'H_15', 'H_16']) {
      expect(getQuestionById(id)).toBeUndefined()
    }
  })
})
