import { sql } from "drizzle-orm"
import { customerOrder } from "@/lib/db/schema/order"

// Cumulative Midtrans snapshots include requested but not yet bank-confirmed
// refunds. Remove our tracked pending amount, then add confirmed offline payouts.
export function confirmedOrderRefundSql() {
  return sql<number>`greatest(0,
    coalesce(${customerOrder.midtransRefundAmount}, CASE WHEN ${customerOrder.paymentStatus} = 'refunded' THEN ${customerOrder.grossAmount} ELSE 0 END)
    - coalesce((SELECT sum(greatest(f.provider_observed_amount,
      CASE WHEN f.first_attempt_at IS NOT NULL THEN least(f.amount, coalesce("customer_order"."midtrans_refund_amount", 0)) ELSE 0 END))
      FROM return_refund f JOIN return_request r ON r.id = f.return_id
      WHERE r.order_id = "customer_order"."id" AND f.method = 'midtrans' AND f.status <> 'confirmed'), 0)
  ) + coalesce((SELECT sum(f.amount) FROM return_refund f JOIN return_request r ON r.id = f.return_id
    WHERE r.order_id = "customer_order"."id" AND f.method = 'offline' AND f.status = 'confirmed'), 0)`
}
