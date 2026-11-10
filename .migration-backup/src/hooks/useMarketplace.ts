import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/sonner-toast";

export interface MarketplaceProduct {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  unit: string;
  image_url: string;
  location: string;
  status: string;
  stock: number;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceOrder {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: string;
  quantity: number;
  total_price: number;
  status: string;
  notes: string;
  buyer_name: string;
  buyer_phone: string;
  buyer_address: string;
  created_at: string;
  updated_at: string;
  // joined
  product?: MarketplaceProduct;
}

export type ProductInsert = Omit<MarketplaceProduct, "id" | "created_at" | "updated_at" | "user_id">;

export function useMarketplaceProducts(onlyMine = false) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["marketplace_products", onlyMine, user?.id],
    queryFn: async () => {
      let q = supabase.from("marketplace_products").select("*").order("created_at", { ascending: false });
      if (onlyMine && user) {
        q = q.eq("user_id", user.id);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as MarketplaceProduct[];
    },
    enabled: !!user,
  });

  const createProduct = useMutation({
    mutationFn: async (input: ProductInsert) => {
      const { data, error } = await supabase
        .from("marketplace_products")
        .insert({ ...input, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as MarketplaceProduct;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketplace_products"] });
      toast.success("Produk berhasil ditambahkan");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, ...input }: Partial<MarketplaceProduct> & { id: string }) => {
      const { data, error } = await supabase
        .from("marketplace_products")
        .update(input)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as MarketplaceProduct;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketplace_products"] });
      toast.success("Produk berhasil diperbarui");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketplace_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketplace_products"] });
      toast.success("Produk berhasil dihapus");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { products: query.data ?? [], isLoading: query.isLoading, createProduct, updateProduct, deleteProduct };
}

export function useMarketplaceOrders(mode: "buyer" | "seller" | "admin" = "buyer") {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["marketplace_orders", mode, user?.id],
    queryFn: async () => {
      let q = supabase
        .from("marketplace_orders")
        .select("*, product:marketplace_products(*)")
        .order("created_at", { ascending: false });
      if (mode === "buyer" && user) {
        q = q.eq("buyer_id", user.id);
      } else if (mode === "seller" && user) {
        q = q.eq("seller_id", user.id);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as MarketplaceOrder[];
    },
    enabled: !!user,
  });

  const createOrder = useMutation({
    mutationFn: async (input: {
      product_id: string;
      seller_id: string;
      quantity: number;
      total_price: number;
      buyer_name: string;
      buyer_phone: string;
      buyer_address: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("marketplace_orders")
        .insert({ ...input, buyer_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as MarketplaceOrder;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketplace_orders"] });
      toast.success("Pesanan berhasil dibuat");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateOrderStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("marketplace_orders")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketplace_orders"] });
      toast.success("Status pesanan diperbarui");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { orders: query.data ?? [], isLoading: query.isLoading, createOrder, updateOrderStatus };
}
