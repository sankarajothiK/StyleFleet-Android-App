import { billingRepository, SalesMetrics } from '../repositories/billingRepository';
import { expenseRepository, PnLMetrics } from '../repositories/expenseRepository';
import { Period, Bill, Expense } from '../types/domain';

export class FinancialService {
  getSalesMetrics(period: Period, billsList?: Bill[]): SalesMetrics {
    return billingRepository.getSalesMetrics(period, billsList);
  }

  getPnLMetrics(period: Period, billsList?: Bill[], expensesList?: Expense[]): PnLMetrics {
    return expenseRepository.getPnLMetrics(period, billsList, expensesList);
  }
}

export const financialService = new FinancialService();
