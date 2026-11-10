import { BarChart3, Loader2, TrendingUp, ShoppingBag, Package, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMarketplaceOrders, useMarketplaceProducts } from "@/hooks/useMarketplace";

const formatRupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

export default function AdminSalesStats() {
  const { orders, isLoading: loadOrders } = useMarketplaceOrders("admin");
  const { products, isLoading: loadProducts } = useMarketplaceProducts();

  const totalRevenue = orders.filter((o) => o.status === "completed").reduce((sum, o) => sum + o.total_price, 0);
  const totalOrders = orders.length;
  const completedOrders = orders.filter((o) => o.status === "completed").length;
  const pendingOrders = orders.filter((o) => o.status === "pending").length;

  const isLoading = loadOrders || loadProducts;

  const stats = [
    { title: "Total Produk", value: products.length.toString(), icon: Package, color: "text-primary" },
    { title: "Total Pesanan", value: totalOrders.toString(), icon: ShoppingBag, color: "text-primary" },
    { title: "Pesanan Selesai", value: completedOrders.toString(), icon: TrendingUp, color: "text-green-600" },
    { title: "Total Pendapatan", value: formatRupiah(totalRevenue), icon: DollarSign, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Statistik Penjualan</h1>
          <p className="text-sm text-muted-foreground">Analisis marketplace</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s) => (
              <Card key={s.title}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                    <s.icon className={`w-4 h-4 ${s.color}`} /> {s.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold font-heading">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {pendingOrders > 0 && (
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
              <CardContent className="py-4 flex items-center gap-3">
                <ShoppingBag className="w-5 h-5 text-amber-600" />
                <p className="text-sm font-medium">{pendingOrders} pesanan menunggu konfirmasi</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
