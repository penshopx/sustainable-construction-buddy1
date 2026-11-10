import { useState } from "react";
import { ShoppingBag, Loader2, Package, Clock, CheckCircle2, XCircle, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useMarketplaceOrders } from "@/hooks/useMarketplace";

const formatRupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: LucideIcon }> = {
  pending: { label: "Menunggu", variant: "outline", icon: Clock },
  confirmed: { label: "Dikonfirmasi", variant: "secondary", icon: CheckCircle2 },
  shipped: { label: "Dikirim", variant: "default", icon: Package },
  completed: { label: "Selesai", variant: "default", icon: CheckCircle2 },
  cancelled: { label: "Dibatalkan", variant: "destructive", icon: XCircle },
};

export default function MyOrders() {
  const { orders: buyerOrders, isLoading: loadBuyer, updateOrderStatus } = useMarketplaceOrders("buyer");
  const { orders: sellerOrders, isLoading: loadSeller } = useMarketplaceOrders("seller");

  const renderOrders = (orders: typeof buyerOrders, isSeller: boolean) => {
    if (orders.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="font-heading font-semibold">Belum ada pesanan</p>
          <p className="text-sm mt-1 mb-4">
            {isSeller ? "Belum ada pesanan masuk dari pembeli." : "Mulai belanja di marketplace untuk melihat pesanan Anda di sini."}
          </p>
          <div className="grid sm:grid-cols-2 gap-3 max-w-md mx-auto text-left">
            {[
              { product: "Template RAB Gedung", qty: 1, total: "Rp 250.000", status: "Dikonfirmasi" },
              { product: "Jasa Konsultasi SBU", qty: 1, total: "Rp 2.500.000", status: "Menunggu" },
            ].map((ex, i) => (
              <div key={i} className="p-3 rounded-lg border border-dashed border-border bg-muted/30">
                <p className="text-xs font-heading font-semibold text-foreground">{ex.product}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Qty: {ex.qty} · {ex.total}</p>
                <Badge variant="outline" className="text-[10px] mt-1.5">{ex.status}</Badge>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">👆 Contoh tampilan pesanan</p>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {orders.map((order) => {
          const s = STATUS_MAP[order.status] || STATUS_MAP.pending;
          const Icon = s.icon;
          return (
            <Card key={order.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-heading">{order.product?.title || "Produk"}</CardTitle>
                  <Badge variant={s.variant} className="gap-1"><Icon className="w-3 h-3" />{s.label}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Qty:</span> {order.quantity}</div>
                  <div><span className="text-muted-foreground">Total:</span> {formatRupiah(order.total_price)}</div>
                  <div><span className="text-muted-foreground">Pemesan:</span> {order.buyer_name}</div>
                  <div><span className="text-muted-foreground">Tanggal:</span> {new Date(order.created_at).toLocaleDateString("id-ID")}</div>
                </div>
                {order.notes && <p className="text-xs text-muted-foreground mt-2">Catatan: {order.notes}</p>}
                {isSeller && order.status === "pending" && (
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={() => updateOrderStatus.mutate({ id: order.id, status: "confirmed" })}>Konfirmasi</Button>
                    <Button size="sm" variant="destructive" onClick={() => updateOrderStatus.mutate({ id: order.id, status: "cancelled" })}>Tolak</Button>
                  </div>
                )}
                {isSeller && order.status === "confirmed" && (
                  <Button size="sm" className="mt-3" onClick={() => updateOrderStatus.mutate({ id: order.id, status: "shipped" })}>Tandai Dikirim</Button>
                )}
                {!isSeller && order.status === "shipped" && (
                  <Button size="sm" className="mt-3" onClick={() => updateOrderStatus.mutate({ id: order.id, status: "completed" })}>Selesai Diterima</Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <ShoppingBag className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Pesanan Saya</h1>
          <p className="text-sm text-muted-foreground">Kelola pesanan marketplace Anda</p>
        </div>
      </div>

      <Tabs defaultValue="buyer">
        <TabsList>
          <TabsTrigger value="buyer">Pesanan Saya ({buyerOrders.length})</TabsTrigger>
          <TabsTrigger value="seller">Pesanan Masuk ({sellerOrders.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="buyer">
          {loadBuyer ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : renderOrders(buyerOrders, false)}
        </TabsContent>
        <TabsContent value="seller">
          {loadSeller ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : renderOrders(sellerOrders, true)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
