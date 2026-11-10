import { ShoppingBag, Loader2, Clock, CheckCircle2, Package, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMarketplaceOrders } from "@/hooks/useMarketplace";

const formatRupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

const STATUSES = ["pending", "confirmed", "shipped", "completed", "cancelled"];
const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Menunggu", variant: "outline" },
  confirmed: { label: "Dikonfirmasi", variant: "secondary" },
  shipped: { label: "Dikirim", variant: "default" },
  completed: { label: "Selesai", variant: "default" },
  cancelled: { label: "Dibatalkan", variant: "destructive" },
};

export default function AdminOrders() {
  const { orders, isLoading, updateOrderStatus } = useMarketplaceOrders("admin");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <ShoppingBag className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Kelola Pesanan</h1>
          <p className="text-sm text-muted-foreground">Monitor semua pesanan ({orders.length})</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-heading font-semibold">Belum ada pesanan</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const s = STATUS_MAP[order.status] || STATUS_MAP.pending;
            return (
              <Card key={order.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-heading">{order.product?.title || "Produk"}</CardTitle>
                    <Badge variant={s.variant}>{s.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm mb-3">
                    <div><span className="text-muted-foreground">Pemesan:</span> {order.buyer_name}</div>
                    <div><span className="text-muted-foreground">Qty:</span> {order.quantity}</div>
                    <div><span className="text-muted-foreground">Total:</span> {formatRupiah(order.total_price)}</div>
                    <div><span className="text-muted-foreground">Tanggal:</span> {new Date(order.created_at).toLocaleDateString("id-ID")}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Ubah status:</span>
                    <Select value={order.status} onValueChange={(v) => updateOrderStatus.mutate({ id: order.id, status: v })}>
                      <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((st) => <SelectItem key={st} value={st}>{STATUS_MAP[st]?.label || st}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
