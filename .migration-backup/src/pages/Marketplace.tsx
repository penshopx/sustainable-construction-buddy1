import { useState, useMemo } from "react";
import { Store, Search, Plus, Tag, ShoppingCart, Loader2, Package } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMarketplaceProducts, useMarketplaceOrders } from "@/hooks/useMarketplace";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

const CATEGORIES = [
  { value: "all", label: "Semua" },
  { value: "software", label: "Software" },
  { value: "chatbot_ai", label: "Chatbot AI" },
  { value: "template", label: "Template" },
  { value: "sop", label: "SOP" },
  { value: "ebook", label: "E-Book" },
  { value: "toolkit", label: "Toolkit" },
  { value: "material", label: "Material" },
  { value: "jasa_perusahaan", label: "Jasa Perusahaan" },
  { value: "jasa_perorangan", label: "Jasa Perorangan" },
];

const formatRupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

export default function Marketplace() {
  const { user, profile } = useAuth();
  const { products, isLoading } = useMarketplaceProducts();
  const { createOrder } = useMarketplaceOrders("buyer");
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [orderDialog, setOrderDialog] = useState<string | null>(null);
  const [orderForm, setOrderForm] = useState({ quantity: 1, buyer_name: "", buyer_phone: "", buyer_address: "", notes: "" });

  const filtered = products
    .filter((p) => p.status === "active")
    .filter((p) => {
      const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase());
      const matchCat = category === "all" || p.category === category;
      return matchSearch && matchCat;
    });

  const handleOrder = (product: typeof products[0]) => {
    createOrder.mutate(
      {
        product_id: product.id,
        seller_id: product.user_id,
        quantity: orderForm.quantity,
        total_price: product.price * orderForm.quantity,
        buyer_name: orderForm.buyer_name || profile?.full_name || "",
        buyer_phone: orderForm.buyer_phone,
        buyer_address: orderForm.buyer_address,
        notes: orderForm.notes,
      },
      {
        onSuccess: () => {
          setOrderDialog(null);
          setOrderForm({ quantity: 1, buyer_name: "", buyer_phone: "", buyer_address: "", notes: "" });
        },
      }
    );
  };

  // Parse tags from description (lines starting with #tag or comma-separated features)
  const parseTags = (desc: string): string[] => {
    // Simple: split by comma or newline, take short phrases as tags
    const parts = desc.split(/[,\n]/).map(s => s.trim()).filter(s => s.length > 0 && s.length < 40);
    return parts.slice(0, 3);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Marketplace Digital</h1>
          <p className="text-sm text-muted-foreground">Produk digital untuk mendukung profesionalisme BUJK Anda</p>
        </div>
        <Button onClick={() => navigate("/produk-saya")} className="gap-2">
          <Plus className="w-4 h-4" /> Tambah Produk
        </Button>
      </div>

      {/* Category stats */}
      {!isLoading && products.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <div className="px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
            <Package className="w-3 h-3 inline mr-1" /> {products.filter(p => p.status === "active").length} produk aktif
          </div>
          {CATEGORIES.filter(c => c.value !== "all").map(c => {
            const count = products.filter(p => p.category === c.value && p.status === "active").length;
            if (count === 0) return null;
            return (
              <span key={c.value} className="px-2 py-1 rounded-full text-[10px] bg-muted text-muted-foreground">
                {c.label}: {count}
              </span>
            );
          })}
        </div>
      )}

      {/* Search + Category Tabs */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Cari produk..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                  category === c.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Product Grid */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground space-y-6">
          <Store className="w-12 h-12 mx-auto opacity-30" />
          <div>
            <p className="font-heading font-semibold text-foreground text-lg">Belum ada produk</p>
            <p className="text-sm mt-1">Jadilah yang pertama menawarkan produk/jasa Anda di marketplace BUJK!</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl mx-auto text-left">
            {[
              { title: "Template RAB Proyek Gedung", cat: "Template", price: "Rp 250.000", desc: "Template RAB lengkap untuk proyek gedung bertingkat, termasuk BQ & schedule." },
              { title: "SOP K3 Konstruksi", cat: "SOP", price: "Rp 150.000", desc: "Paket SOP keselamatan kerja sesuai standar SMK3 terbaru." },
              { title: "Jasa Konsultasi SBU", cat: "Jasa Perusahaan", price: "Rp 5.000.000", desc: "Pendampingan pengurusan SBU baru atau perpanjangan dari ahli bersertifikat." },
            ].map((ex, i) => (
              <Card key={i} className="border-dashed border-2 border-muted-foreground/20 bg-muted/20">
                <CardContent className="p-4 space-y-2">
                  <Badge variant="outline" className="text-[10px]">{ex.cat}</Badge>
                  <p className="font-heading font-semibold text-foreground text-sm">{ex.title}</p>
                  <p className="text-xs text-muted-foreground">{ex.desc}</p>
                  <p className="text-sm font-bold text-primary">{ex.price}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground italic">☝ Contoh produk di atas — klik "Tambah Produk" untuk mulai berjualan</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((product, idx) => {
            const catLabel = CATEGORIES.find((c) => c.value === product.category)?.label || product.category;
            const tags = parseTags(product.description);
            const hasDiscount = product.stock > 0; // use stock > 0 as proxy for featured/discount badge

            return (
              <motion.div key={product.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
              <Card className="flex flex-col overflow-hidden hover:shadow-lg transition-shadow duration-200 border-border/60 h-full">
                {/* Image / Placeholder area */}
                <div className="relative h-44 bg-muted/40 flex items-center justify-center">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.title} className="w-full h-full object-cover" />
                  ) : (
                    <Tag className="w-12 h-12 text-muted-foreground/30" />
                  )}
                  {/* Category badge */}
                  <Badge className="absolute top-3 left-3 text-[10px] uppercase tracking-wider font-bold bg-primary/90 text-primary-foreground">
                    {catLabel}
                  </Badge>
                  {hasDiscount && (
                    <Badge variant="destructive" className="absolute top-3 right-3 text-[10px] uppercase tracking-wider font-bold">
                      Diskon
                    </Badge>
                  )}
                </div>

                {/* Content */}
                <CardContent className="flex-1 pt-4 pb-3 space-y-2">
                  <h3 className="font-heading font-bold text-foreground line-clamp-2 leading-tight">{product.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
                  {/* Tags */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {tags.map((tag, i) => (
                        <span key={i} className="text-[11px] px-2 py-0.5 rounded-md bg-accent text-accent-foreground border border-border/50">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>

                {/* Footer: Price + Order */}
                <CardFooter className="flex items-center justify-between pt-3 pb-4 border-t border-border/50">
                  <div>
                    <p className="text-lg font-bold text-primary">{formatRupiah(product.price)}</p>
                    <p className="text-xs text-muted-foreground">per {product.unit}</p>
                  </div>
                  {product.user_id !== user?.id && (
                    <Dialog open={orderDialog === product.id} onOpenChange={(open) => setOrderDialog(open ? product.id : null)}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="gap-1.5">
                          <ShoppingCart className="w-3.5 h-3.5" /> Pesan
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Pesan: {product.title}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Jumlah</Label>
                              <Input type="number" min={1} value={orderForm.quantity} onChange={(e) => setOrderForm((f) => ({ ...f, quantity: Number(e.target.value) || 1 }))} />
                            </div>
                            <div>
                              <Label>Total</Label>
                              <p className="text-lg font-bold text-primary mt-1">{formatRupiah(product.price * orderForm.quantity)}</p>
                            </div>
                          </div>
                          <div>
                            <Label>Nama Pemesan</Label>
                            <Input value={orderForm.buyer_name || profile?.full_name || ""} onChange={(e) => setOrderForm((f) => ({ ...f, buyer_name: e.target.value }))} />
                          </div>
                          <div>
                            <Label>No. Telepon</Label>
                            <Input value={orderForm.buyer_phone} onChange={(e) => setOrderForm((f) => ({ ...f, buyer_phone: e.target.value }))} />
                          </div>
                          <div>
                            <Label>Alamat Pengiriman</Label>
                            <Textarea value={orderForm.buyer_address} onChange={(e) => setOrderForm((f) => ({ ...f, buyer_address: e.target.value }))} />
                          </div>
                          <div>
                            <Label>Catatan (opsional)</Label>
                            <Textarea value={orderForm.notes} onChange={(e) => setOrderForm((f) => ({ ...f, notes: e.target.value }))} />
                          </div>
                          <Button className="w-full" onClick={() => handleOrder(product)} disabled={createOrder.isPending}>
                            {createOrder.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Konfirmasi Pesanan
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </CardFooter>
              </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
