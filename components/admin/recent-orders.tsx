import { AdminCard, AdminCardLink } from "@/components/admin/admin-card"
import { OrderStatusBadge } from "@/components/orders/order-status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { adminSection } from "@/lib/admin/config"
import { orderItemCount, orderTotal, type Order } from "@/lib/orders/config"
import {
  formatNumber,
  formatRupiah,
  formatShortDate,
} from "@/utils/format/intl"

const EDGE = "first:pl-(--card-spacing) last:pr-(--card-spacing)"

function RecentOrders({ orders }: { orders: readonly Order[] }) {
  const ordersSection = adminSection("orders")

  return (
    <AdminCard
      title="Pesanan Terbaru"
      description="Pesanan yang paling baru masuk."
      contentClassName="px-0"
      action={
        <AdminCardLink href={ordersSection.href}>Lihat Semua</AdminCardLink>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={EDGE}>Invoice</TableHead>
            <TableHead className={EDGE}>Tanggal</TableHead>
            <TableHead className={EDGE}>Status</TableHead>
            <TableHead className={`${EDGE} text-right`}>Barang</TableHead>
            <TableHead className={`${EDGE} text-right`}>Total</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell className={`${EDGE} font-mono text-xs`}>
                {order.id}
              </TableCell>
              <TableCell className={`${EDGE} text-muted-foreground`}>
                {formatShortDate(order.placedAt)}
              </TableCell>
              <TableCell className={EDGE}>
                <OrderStatusBadge status={order.status} />
              </TableCell>
              <TableCell className={`${EDGE} text-right tabular-nums`}>
                {formatNumber(orderItemCount(order))}
              </TableCell>
              <TableCell
                className={`${EDGE} text-right font-medium tabular-nums`}
              >
                {formatRupiah(orderTotal(order))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </AdminCard>
  )
}

export { RecentOrders }
