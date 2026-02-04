import dayjs from 'dayjs';

/**
 * 基金交易相关工具函数
 */

// 交易截止时间：15:00
export const TRADE_DEADLINE_HOUR = 15;

/**
 * 判断指定时间是否为交易日（周一至周五，暂不考虑节假日）
 */
export const isTradingDay = (date: dayjs.Dayjs) => {
  const day = date.day();
  return day >= 1 && day <= 5;
};

/**
 * 获取下一个交易日
 */
export const getNextTradingDay = (date: dayjs.Dayjs): dayjs.Dayjs => {
  let next = date.add(1, 'day');
  while (!isTradingDay(next)) {
    next = next.add(1, 'day');
  }
  return next;
};

/**
 * 判断当前是否在交易截止时间（15:00）之前
 */
export const isBeforeDeadline = (date: dayjs.Dayjs = dayjs()) => {
  return date.hour() < TRADE_DEADLINE_HOUR;
};

/**
 * 获取交易生效日期（净值确认日）
 * 如果在交易日 15:00 前，生效日为今日
 * 否则，生效日为下一个交易日
 */
export const getEffectiveDate = (date: dayjs.Dayjs = dayjs()): string => {
  if (isTradingDay(date) && isBeforeDeadline(date)) {
    return date.format('YYYY-MM-DD');
  }
  return getNextTradingDay(date).format('YYYY-MM-DD');
};

/**
 * 获取开始计算收益的日期
 * 如果在交易日 15:00 前，今日确认净值，明日起计算收益
 * 否则，明日确认净值，后日起计算收益
 */
export const getProfitStartDate = (date: dayjs.Dayjs = dayjs()): string => {
  const effectiveDate = dayjs(getEffectiveDate(date));
  return getNextTradingDay(effectiveDate).format('YYYY-MM-DD');
};

/**
 * 获取交易描述信息
 */
export const getTradeStatusInfo = (date: dayjs.Dayjs = dayjs()) => {
  const beforeDeadline = isBeforeDeadline(date);
  const tradingDay = isTradingDay(date);
  
  if (tradingDay && beforeDeadline) {
    return {
      status: 'before_deadline',
      message: `当前时间 ${date.format('HH:mm')}，处于 15:00 截止前。`,
      detail: `今日 (${date.format('MM-DD')}) 确认净值，明日起计算收益。`,
      effectiveDate: date.format('YYYY-MM-DD'),
      profitDate: getProfitStartDate(date)
    };
  } else {
    const nextTrading = getNextTradingDay(date);
    const profitDate = getProfitStartDate(date);
    return {
      status: 'after_deadline',
      message: tradingDay 
        ? `当前时间 ${date.format('HH:mm')}，已过 15:00 截止点。` 
        : `当前是周${'日一二三四五六'[date.day()]}，非交易时间。`,
      detail: `将于下个交易日 (${nextTrading.format('MM-DD')}) 确认净值，${dayjs(profitDate).format('MM-DD')}起计算收益。`,
      effectiveDate: nextTrading.format('YYYY-MM-DD'),
      profitDate: profitDate
    };
  }
};
