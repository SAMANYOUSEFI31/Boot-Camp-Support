/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** پیام خطا از هر مقدار پرتاب‌شده */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
