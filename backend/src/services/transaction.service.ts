import crypto from 'crypto';

interface PendingTransaction {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timeoutId: NodeJS.Timeout;
}

class TransactionService {
  // Map of transactionId -> PendingTransaction callbacks and timeout reference
  private pendingTransactions = new Map<string, PendingTransaction>();

  /**
   * Registers a new transaction and returns its ID along with a promise.
   * The promise will resolve when the device acknowledges, or reject on timeout.
   */
  public createTransaction(timeoutMs = 5000): { transactionId: string; promise: Promise<any> } {
    const transactionId = crypto.randomUUID();

    const promise = new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.pendingTransactions.has(transactionId)) {
          this.pendingTransactions.delete(transactionId);
          reject(new Error('Device response timeout'));
        }
      }, timeoutMs);

      this.pendingTransactions.set(transactionId, { resolve, reject, timeoutId });
    });

    return { transactionId, promise };
  }

  /**
   * Resolves a pending transaction with the response data from the device.
   */
  public resolveTransaction(transactionId: string, payload: any): boolean {
    const pending = this.pendingTransactions.get(transactionId);
    if (!pending) {
      return false; // Not found or already expired
    }

    clearTimeout(pending.timeoutId);
    this.pendingTransactions.delete(transactionId);
    pending.resolve(payload);
    return true;
  }

  /**
   * Rejects a pending transaction with a specific error.
   */
  public rejectTransaction(transactionId: string, error: Error): boolean {
    const pending = this.pendingTransactions.get(transactionId);
    if (!pending) {
      return false;
    }

    clearTimeout(pending.timeoutId);
    this.pendingTransactions.delete(transactionId);
    pending.reject(error);
    return true;
  }
}

export const transactionService = new TransactionService();
