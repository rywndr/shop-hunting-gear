import { sql, type SQLWrapper } from "drizzle-orm"

import { ACTIONABLE_RETURN_STATUSES, ACTIVE_REFUND_STATUSES } from "./queue"

function sqlValues(values: readonly string[]) {
  return sql.join(
    values.map((value) => sql`${value}`),
    sql`, `
  )
}

// Keep the default qualified. Drizzle can render a selected table column as
// "id", which becomes ambiguous inside the return subquery.
export function hasActionableReturnSql(
  orderId: SQLWrapper = sql`"customer_order"."id"`
) {
  return sql<boolean>`EXISTS (
    SELECT 1
    FROM return_request request
    LEFT JOIN return_refund refund ON refund.return_id = request.id
    WHERE request.order_id = ${orderId}
      AND request.status IN (${sqlValues(ACTIONABLE_RETURN_STATUSES)})
      AND (
        refund.id IS NULL
        OR refund.status IN (${sqlValues(ACTIVE_REFUND_STATUSES)})
      )
  )`
}
