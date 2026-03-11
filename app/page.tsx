"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "../lib/supabase-browser"

type Product = {
  id: number
  name: string
  category: string | null
  price: number
  active: boolean
  image_url?: string | null
  promo_price?: number | null
  promo_start?: string | null
  promo_end?: string | null
  stock_min?: number
  stock_qty?: number
}

type Consumption = {
  id: number
  amount: number
  product_id: number
  consumed_at: string
}

type Profile = {
  monthly_fee: number | null
  role: string | null
}

type StockViewRow = {
  id: number
  name: string
  category: string | null
  price: number
  promo_price?: number | null
  promo_start?: string | null
  promo_end?: string | null
  active: boolean
  image_url?: string | null
  stock_min: number
  stock_qty: number
}

type CartItem = {
  productId: number
  qty: number
}

export default function Home() {
  const supabase = createClient()

  const defaultMessage = "Veuillez choisir un ou plusieurs produit(s)"

  const articlesIconUrl = ""
  const cotisationIconUrl = ""
  const totalIconUrl = ""

  const [email, setEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [monthlyTotal, setMonthlyTotal] = useState<number>(0)
  const [monthlyFee, setMonthlyFee] = useState<number>(0)
  const [isAdmin, setIsAdmin] = useState(false)
  const [latestConsumption, setLatestConsumption] = useState<Consumption | null>(null)

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string>(defaultMessage)
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info")
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>("Tous")
  const [searchTerm, setSearchTerm] = useState<string>("")

  const [adminProductId, setAdminProductId] = useState<string>("")
  const [adminPromoPrice, setAdminPromoPrice] = useState<string>("")
  const [adminPromoStart, setAdminPromoStart] = useState<string>("")
  const [adminPromoEnd, setAdminPromoEnd] = useState<string>("")

  const [adminStockProductId, setAdminStockProductId] = useState<string>("")
  const [adminStockQty, setAdminStockQty] = useState<string>("")
  const [adminStockReason, setAdminStockReason] = useState<string>("Réapprovisionnement")

  const [cart, setCart] = useState<CartItem[]>([])
  const [isSubmittingCart, setIsSubmittingCart] = useState(false)

  const getMonthKey = () => {
    const now = new Date()
    return `${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`
  }

  const isPromoActive = (product: Product) => {
    if (product.promo_price === null || product.promo_price === undefined) return false

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const start = product.promo_start ? new Date(product.promo_start) : null
    const end = product.promo_end ? new Date(product.promo_end) : null

    if (start) start.setHours(0, 0, 0, 0)
    if (end) end.setHours(0, 0, 0, 0)

    if (!start && !end) return true
    if (start && today < start) return false
    if (end && today > end) return false

    return true
  }

  const getEffectivePrice = (product: Product) => {
    if (isPromoActive(product) && product.promo_price !== null && product.promo_price !== undefined) {
      return Number(product.promo_price)
    }
    return Number(product.price)
  }

  const getDiscountPercent = (product: Product) => {
    if (!isPromoActive(product)) return null
    if (product.promo_price === null || product.promo_price === undefined) return null

    const normalPrice = Number(product.price)
    const promoPrice = Number(product.promo_price)

    if (normalPrice <= 0 || promoPrice >= normalPrice) return null

    return Math.round(((normalPrice - promoPrice) / normalPrice) * 100)
  }

  const getStockStatus = (product: Product) => {
    const qty = Number(product.stock_qty || 0)
    const min = Number(product.stock_min || 0)

    if (qty <= 0) {
      return {
        label: "Rupture",
        color: "#c1121f",
        background: "#ffe5e8",
      }
    }

    if (qty <= min) {
      return {
        label: "Stock faible",
        color: "#b26b00",
        background: "#fff2db",
      }
    }

    return {
      label: "Stock OK",
      color: "#1b7f3b",
      background: "#e9f9ef",
    }
  }

  const loadProfile = async (currentUserId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("monthly_fee, role")
      .eq("id", currentUserId)
      .single()

    if (error || !data) {
      setMonthlyFee(0)
      setIsAdmin(false)
      return false
    }

    const profile = data as Profile
    setMonthlyFee(Number(profile.monthly_fee ?? 0))
    const admin = profile.role === "admin"
    setIsAdmin(admin)
    return admin
  }

  const loadProducts = async (adminFlag: boolean) => {
    if (adminFlag) {
      const { data, error } = await supabase.rpc("get_product_stock_view")

      if (!error && data) {
        const normalized = (data as StockViewRow[]).map((p) => ({
          ...p,
          stock_min: Number(p.stock_min || 0),
          stock_qty: Number(p.stock_qty || 0),
        }))

        setProducts(normalized)

        if (!adminProductId && normalized.length > 0) {
          setAdminProductId(String(normalized[0].id))
        }

        if (!adminStockProductId && normalized.length > 0) {
          setAdminStockProductId(String(normalized[0].id))
        }
      }

      return
    }

    const { data, error } = await supabase.rpc("get_available_products")

    if (!error && data) {
      setProducts(data as Product[])
    }
  }

  const loadMonthlyTotal = async (currentUserId: string) => {
    const monthKey = getMonthKey()

    const { data, error } = await supabase
      .from("consumptions")
      .select("amount")
      .eq("user_id", currentUserId)
      .eq("month_key", monthKey)

    if (error || !data) {
      setMonthlyTotal(0)
      return
    }

    const total = (data as { amount: number }[]).reduce((sum, row) => sum + Number(row.amount), 0)
    setMonthlyTotal(Number(total.toFixed(2)))
  }

  const loadLatestConsumption = async (currentUserId: string) => {
    const { data, error } = await supabase
      .from("consumptions")
      .select("id, amount, product_id, consumed_at")
      .eq("user_id", currentUserId)
      .order("consumed_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) {
      setLatestConsumption(null)
      return
    }

    setLatestConsumption(data as Consumption)
  }

  useEffect(() => {
    const loadData = async () => {
      const { data: userData } = await supabase.auth.getUser()
      const currentEmail = userData.user?.email ?? null
      const currentUserId = userData.user?.id ?? null

      setEmail(currentEmail)
      setUserId(currentUserId)

      let adminFlag = false

      if (currentUserId) {
        adminFlag = await loadProfile(currentUserId)
        await loadMonthlyTotal(currentUserId)
        await loadLatestConsumption(currentUserId)
      }

      await loadProducts(adminFlag)

      if (currentEmail) {
        setMessage(defaultMessage)
        setMessageType("info")
      }

      setLoading(false)
    }

    loadData()

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentEmail = session?.user?.email ?? null
      const currentUserId = session?.user?.id ?? null

      setEmail(currentEmail)
      setUserId(currentUserId)

      if (currentEmail) {
        setMessage(defaultMessage)
        setMessageType("info")
      }

      if (currentUserId) {
        const adminFlag = await loadProfile(currentUserId)
        await loadMonthlyTotal(currentUserId)
        await loadLatestConsumption(currentUserId)
        await loadProducts(adminFlag)
      } else {
        setMonthlyTotal(0)
        setMonthlyFee(0)
        setIsAdmin(false)
        setLatestConsumption(null)
        setProducts([])
      }
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (messageType !== "success" && messageType !== "error") return

    const timer = setTimeout(() => {
      setMessage(defaultMessage)
      setMessageType("info")
      setSelectedProductId(null)
    }, 3000)

    return () => clearTimeout(timer)
  }, [messageType])

  const categories = useMemo(() => {
    const uniqueCategories = Array.from(
      new Set(
        products
          .map((product) => product.category?.trim())
          .filter((category): category is string => Boolean(category))
      )
    ).sort((a, b) => a.localeCompare(b))

    return ["Tous", ...uniqueCategories]
  }, [products])

  const filteredProducts = useMemo(() => {
    const filtered = products.filter((product) => {
      const matchesCategory =
        selectedCategory === "Tous" || product.category === selectedCategory

      const matchesSearch =
        searchTerm.trim() === "" ||
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.category ?? "").toLowerCase().includes(searchTerm.toLowerCase())

      return matchesCategory && matchesSearch
    })

    return filtered.sort((a, b) => {
      const promoA = isPromoActive(a)
      const promoB = isPromoActive(b)

      if (promoA && !promoB) return -1
      if (!promoA && promoB) return 1

      return a.name.localeCompare(b.name)
    })
  }, [products, selectedCategory, searchTerm])

  const cartDetailed = useMemo(() => {
    return cart
      .map((item) => {
        const product = products.find((p) => p.id === item.productId)
        if (!product) return null

        const unitPrice = getEffectivePrice(product)

        return {
          ...item,
          product,
          unitPrice,
          lineTotal: Number((unitPrice * item.qty).toFixed(2)),
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
  }, [cart, products])

  const cartTotal = useMemo(() => {
    return Number(cartDetailed.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2))
  }, [cartDetailed])

  const cartCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.qty, 0)
  }, [cart])

  const totalToPay = useMemo(() => {
    return Number((monthlyTotal + monthlyFee).toFixed(2))
  }, [monthlyTotal, monthlyFee])

  const login = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}`,
      },
    })
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setEmail(null)
    setUserId(null)
    setProducts([])
    setMonthlyTotal(0)
    setMonthlyFee(0)
    setIsAdmin(false)
    setLatestConsumption(null)
    setMessage(defaultMessage)
    setMessageType("info")
    setSelectedProductId(null)
    setSelectedCategory("Tous")
    setSearchTerm("")
    setAdminProductId("")
    setAdminPromoPrice("")
    setAdminPromoStart("")
    setAdminPromoEnd("")
    setAdminStockProductId("")
    setAdminStockQty("")
    setAdminStockReason("Réapprovisionnement")
    setCart([])
  }

  const addToCart = (product: Product) => {
    if (isAdmin && Number(product.stock_qty || 0) <= 0) {
      setMessageType("error")
      setMessage(`Stock indisponible : ${product.name}`)
      setSelectedProductId(product.id)
      return
    }

    if (isAdmin) {
      const alreadySelectedQty =
        cart.find((item) => item.productId === product.id)?.qty ?? 0
      const availableQty = Number(product.stock_qty || 0)

      if (alreadySelectedQty >= availableQty) {
        setMessageType("error")
        setMessage(`Quantité maximale atteinte : ${product.name}`)
        setSelectedProductId(product.id)
        return
      }
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id)

      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, qty: item.qty + 1 }
            : item
        )
      }

      return [...prev, { productId: product.id, qty: 1 }]
    })

    setMessageType("success")
    setMessage(`Article ajouté à la sélection : ${product.name}`)
    setSelectedProductId(product.id)
  }

  const removeOneFromCart = (productId: number) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === productId)
      if (!existing) return prev

      if (existing.qty <= 1) {
        return prev.filter((item) => item.productId !== productId)
      }

      return prev.map((item) =>
        item.productId === productId
          ? { ...item, qty: item.qty - 1 }
          : item
      )
    })
  }

  const removeLineFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId))
  }

  const clearCart = () => {
    setCart([])
    setMessageType("info")
    setMessage(defaultMessage)
  }

  const validateCart = async () => {
    if (!userId) return
    if (cartDetailed.length === 0) {
      setMessageType("error")
      setMessage("Aucun article sélectionné")
      return
    }

    setIsSubmittingCart(true)

    try {
      const monthKey = getMonthKey()

      for (const item of cartDetailed) {
        if (isAdmin && Number(item.product.stock_qty || 0) < item.qty) {
          setMessageType("error")
          setMessage(`Stock insuffisant : ${item.product.name}`)
          setIsSubmittingCart(false)
          return
        }

        const { data: insertedConsumption, error: consumptionError } = await supabase
          .from("consumptions")
          .insert({
            user_id: userId,
            product_id: item.productId,
            qty: item.qty,
            unit_price: item.unitPrice,
            amount: Number((item.unitPrice * item.qty).toFixed(2)),
            month_key: monthKey,
          })
          .select("id, amount, product_id, consumed_at")
          .single()

        if (consumptionError || !insertedConsumption) {
          setMessageType("error")
          setMessage("Erreur : " + (consumptionError?.message || "Insertion impossible"))
          setIsSubmittingCart(false)
          return
        }

        const { error: stockError } = await supabase.from("stock_movements").insert({
          product_id: item.productId,
          movement_type: "out",
          quantity: item.qty,
          signed_quantity: -item.qty,
          reason: "Validation sélection utilisateur",
          created_by: userId,
          consumption_id: insertedConsumption.id,
        })

        if (stockError) {
          await supabase.from("consumptions").delete().eq("id", insertedConsumption.id)
          setMessageType("error")
          setMessage("Erreur stock : " + stockError.message)
          setIsSubmittingCart(false)
          return
        }
      }

      setMessageType("success")
      setMessage(`Sélection validée : ${cartCount} article(s)`)
      setMonthlyTotal((prev) => Number((prev + cartTotal).toFixed(2)))
      setCart([])

      await loadLatestConsumption(userId)
      await loadProducts(isAdmin)
    } finally {
      setIsSubmittingCart(false)
    }
  }

  const undoLastConsumption = async () => {
    if (!latestConsumption || !userId) {
      setMessageType("error")
      setMessage("Aucun article à annuler")
      return
    }

    const { error: stockDeleteError } = await supabase
      .from("stock_movements")
      .delete()
      .eq("consumption_id", latestConsumption.id)
      .eq("created_by", userId)
      .eq("movement_type", "out")

    if (stockDeleteError) {
      setMessageType("error")
      setMessage("Erreur stock : " + stockDeleteError.message)
      return
    }

    const { error: consumptionDeleteError } = await supabase
      .from("consumptions")
      .delete()
      .eq("id", latestConsumption.id)

    if (consumptionDeleteError) {
      setMessageType("error")
      setMessage("Erreur : " + consumptionDeleteError.message)
      return
    }

    setMessageType("success")
    setMessage("Dernier article annulé")
    await loadMonthlyTotal(userId)
    await loadLatestConsumption(userId)
    await loadProducts(isAdmin)
  }

  const applyPromo = async () => {
    if (!adminProductId) return

    const promoPriceValue =
      adminPromoPrice.trim() === "" ? null : Number(adminPromoPrice.replace(",", "."))

    const { error } = await supabase
      .from("products")
      .update({
        promo_price: promoPriceValue,
        promo_start: adminPromoStart || null,
        promo_end: adminPromoEnd || null,
      })
      .eq("id", Number(adminProductId))

    if (error) {
      setMessageType("error")
      setMessage("Erreur admin : " + error.message)
      return
    }

    setMessageType("success")
    setMessage("Promo enregistrée")
    await loadProducts(true)
  }

  const clearPromo = async () => {
    if (!adminProductId) return

    const { error } = await supabase
      .from("products")
      .update({
        promo_price: null,
        promo_start: null,
        promo_end: null,
      })
      .eq("id", Number(adminProductId))

    if (error) {
      setMessageType("error")
      setMessage("Erreur admin : " + error.message)
      return
    }

    setAdminPromoPrice("")
    setAdminPromoStart("")
    setAdminPromoEnd("")
    setMessageType("success")
    setMessage("Promo supprimée")
    await loadProducts(true)
  }

  const addStockMovement = async () => {
    if (!userId || !adminStockProductId) return

    const qty = Number(adminStockQty.replace(",", "."))

    if (!qty || qty <= 0) {
      setMessageType("error")
      setMessage("Quantité de stock invalide")
      return
    }

    const { error } = await supabase.from("stock_movements").insert({
      product_id: Number(adminStockProductId),
      movement_type: "in",
      quantity: qty,
      signed_quantity: qty,
      reason: adminStockReason || "Réapprovisionnement",
      created_by: userId,
    })

    if (error) {
      setMessageType("error")
      setMessage("Erreur stock admin : " + error.message)
      return
    }

    setAdminStockQty("")
    setMessageType("success")
    setMessage("Stock mis à jour")
    await loadProducts(true)
  }

  const StatCard = ({
    title,
    value,
    dark = false,
    iconUrl = "",
    fallback = "•",
  }: {
    title: string
    value: string
    dark?: boolean
    iconUrl?: string
    fallback?: string
  }) => {
    return (
      <div
        style={{
          background: dark ? "#111" : "#fff",
          color: dark ? "#fff" : "#111",
          borderRadius: 18,
          padding: 18,
          boxShadow: dark
            ? "0 6px 24px rgba(0,0,0,0.12)"
            : "0 6px 24px rgba(0,0,0,0.06)",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 54,
            height: 54,
            minWidth: 54,
            borderRadius: 14,
            background: dark ? "rgba(255,255,255,0.12)" : "#f4f4f4",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            fontSize: 24,
            fontWeight: "bold",
          }}
        >
          {iconUrl ? (
            <img
              src={iconUrl}
              alt={title}
              style={{
                width: 34,
                height: 34,
                objectFit: "contain",
                display: "block",
              }}
            />
          ) : (
            <span>{fallback}</span>
          )}
        </div>

        <div>
          <div
            style={{
              opacity: dark ? 0.85 : 0.65,
              marginBottom: 8,
              fontSize: 14,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 30,
              fontWeight: "bold",
              lineHeight: 1.1,
            }}
          >
            {value}
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div
        style={{
          padding: 24,
          fontFamily: "Arial, sans-serif",
        }}
      >
        Chargement...
      </div>
    )
  }

  if (!email) {
    return (
      <div
        style={{
          minHeight: "100vh",
          padding: 24,
          fontFamily: "Arial, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f7f7",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            background: "#fff",
            borderRadius: 18,
            padding: 24,
            boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
            textAlign: "center",
          }}
        >
          <h1 style={{ marginTop: 0, marginBottom: 16 }}>POPOTE</h1>
          <p style={{ marginBottom: 20 }}>Connexion à votre espace</p>

          <button
            onClick={login}
            style={{
              width: "100%",
              padding: "14px 18px",
              borderRadius: 12,
              border: "none",
              background: "#111",
              color: "#fff",
              fontWeight: "bold",
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            Se connecter avec Google
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f7f7f7",
        fontFamily: "Arial, sans-serif",
        paddingBottom: 150,
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: 16,
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 18,
            padding: 18,
            boxShadow: "0 6px 24px rgba(0,0,0,0.06)",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1 style={{ margin: 0, marginBottom: 8, fontSize: 28 }}>POPOTE</h1>
              <div style={{ fontSize: 16 }}>
                Connecté : <strong>{email}</strong>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={undoLastConsumption}
                style={{
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: "1px solid #d8d8d8",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: "bold",
                  minWidth: 180,
                }}
              >
                Annuler dernier article
              </button>

              <button
                onClick={logout}
                style={{
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: "1px solid #d8d8d8",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: "bold",
                  minWidth: 140,
                }}
              >
                Se déconnecter
              </button>
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            borderRadius: 18,
            padding: 18,
            boxShadow: "0 6px 24px rgba(0,0,0,0.06)",
            marginBottom: 16,
          }}
        >
          <p
            style={{
              margin: 0,
              color:
                messageType === "success"
                  ? "green"
                  : messageType === "error"
                  ? "red"
                  : "black",
              fontWeight: "bold",
              fontSize: 18,
            }}
          >
            {message}
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginBottom: 16,
          }}
        >
          <StatCard
            title="Articles du mois"
            value={`${monthlyTotal.toFixed(2)} €`}
            iconUrl={articlesIconUrl}
            fallback="🛒"
          />

          <StatCard
            title="Cotisation"
            value={`${monthlyFee.toFixed(2)} €`}
            iconUrl={cotisationIconUrl}
            fallback="💶"
          />

          <StatCard
            title="Total à payer"
            value={`${totalToPay.toFixed(2)} €`}
            iconUrl={totalIconUrl}
            fallback="📌"
            dark
          />
        </div>

        <div
          style={{
            background: "#fff",
            borderRadius: 18,
            padding: 18,
            boxShadow: "0 6px 24px rgba(0,0,0,0.06)",
            marginBottom: 16,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 18, fontSize: 24 }}>Sélection en cours</h2>

          {cartDetailed.length === 0 ? (
            <p style={{ margin: 0, color: "#666" }}>Aucun article sélectionné.</p>
          ) : (
            <div
              style={{
                display: "grid",
                gap: 10,
              }}
            >
              {cartDetailed.map((item) => (
                <div
                  key={item.productId}
                  style={{
                    border: "1px solid #e5e5e5",
                    borderRadius: 12,
                    padding: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: "bold" }}>{item.product.name}</div>
                    <div style={{ color: "#666", fontSize: 14 }}>
                      {item.qty} × {item.unitPrice.toFixed(2)} € = {item.lineTotal.toFixed(2)} €
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => removeOneFromCart(item.productId)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid #d8d8d8",
                        background: "#fff",
                        cursor: "pointer",
                        fontWeight: "bold",
                      }}
                    >
                      Retirer 1
                    </button>

                    <button
                      onClick={() => removeLineFromCart(item.productId)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid #d8d8d8",
                        background: "#fff",
                        cursor: "pointer",
                        fontWeight: "bold",
                      }}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {isAdmin && (
          <>
            <div
              style={{
                background: "#fff",
                borderRadius: 18,
                padding: 18,
                boxShadow: "0 6px 24px rgba(0,0,0,0.06)",
                marginBottom: 16,
              }}
            >
              <h2 style={{ marginTop: 0, marginBottom: 18, fontSize: 24 }}>Mode admin – Promotions</h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                }}
              >
                <select
                  value={adminProductId}
                  onChange={(e) => setAdminProductId(e.target.value)}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #d8d8d8",
                    fontSize: 16,
                    background: "#fff",
                  }}
                >
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="Prix promo"
                  value={adminPromoPrice}
                  onChange={(e) => setAdminPromoPrice(e.target.value)}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #d8d8d8",
                    fontSize: 16,
                  }}
                />

                <input
                  type="date"
                  value={adminPromoStart}
                  onChange={(e) => setAdminPromoStart(e.target.value)}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #d8d8d8",
                    fontSize: 16,
                  }}
                />

                <input
                  type="date"
                  value={adminPromoEnd}
                  onChange={(e) => setAdminPromoEnd(e.target.value)}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #d8d8d8",
                    fontSize: 16,
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
                <button
                  onClick={applyPromo}
                  style={{
                    padding: "12px 16px",
                    borderRadius: 12,
                    border: "none",
                    background: "#111",
                    color: "#fff",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  Enregistrer la promo
                </button>

                <button
                  onClick={clearPromo}
                  style={{
                    padding: "12px 16px",
                    borderRadius: 12,
                    border: "1px solid #d8d8d8",
                    background: "#fff",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  Supprimer la promo
                </button>
              </div>
            </div>

            <div
              style={{
                background: "#fff",
                borderRadius: 18,
                padding: 18,
                boxShadow: "0 6px 24px rgba(0,0,0,0.06)",
                marginBottom: 16,
              }}
            >
              <h2 style={{ marginTop: 0, marginBottom: 18, fontSize: 24 }}>Mode admin – Stock</h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                }}
              >
                <select
                  value={adminStockProductId}
                  onChange={(e) => setAdminStockProductId(e.target.value)}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #d8d8d8",
                    fontSize: 16,
                    background: "#fff",
                  }}
                >
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="Quantité à ajouter"
                  value={adminStockQty}
                  onChange={(e) => setAdminStockQty(e.target.value)}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #d8d8d8",
                    fontSize: 16,
                  }}
                />

                <input
                  type="text"
                  placeholder="Motif"
                  value={adminStockReason}
                  onChange={(e) => setAdminStockReason(e.target.value)}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #d8d8d8",
                    fontSize: 16,
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
                <button
                  onClick={addStockMovement}
                  style={{
                    padding: "12px 16px",
                    borderRadius: 12,
                    border: "none",
                    background: "#111",
                    color: "#fff",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  Ajouter du stock
                </button>
              </div>
            </div>
          </>
        )}

        <div
          style={{
            background: "#fff",
            borderRadius: 18,
            padding: 18,
            boxShadow: "0 6px 24px rgba(0,0,0,0.06)",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 18, fontSize: 24 }}>Produits</h2>

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 18,
            }}
          >
            <input
              type="text"
              placeholder="Rechercher un produit..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                flex: "1 1 260px",
                minWidth: 220,
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid #d8d8d8",
                fontSize: 16,
              }}
            />

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                flex: "0 1 220px",
                minWidth: 180,
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid #d8d8d8",
                fontSize: 16,
                background: "#fff",
              }}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {filteredProducts.length === 0 ? (
            <p>Aucun produit</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 16,
              }}
            >
              {filteredProducts.map((product) => {
                const isSelected = selectedProductId === product.id
                const effectivePrice = getEffectivePrice(product)
                const discountPercent = getDiscountPercent(product)
                const promoActive = isPromoActive(product)
                const stockStatus = getStockStatus(product)
                const isOutOfStock = isAdmin ? Number(product.stock_qty || 0) <= 0 : false
                const cartQty = cart.find((item) => item.productId === product.id)?.qty ?? 0

                return (
                  <div
                    key={product.id}
                    style={{
                      position: "relative",
                      border: isSelected ? "2px solid green" : "1px solid #e5e5e5",
                      borderRadius: 16,
                      padding: 14,
                      background: isSelected ? "#f2fff2" : "#fff",
                      boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
                      transition: "all 0.2s ease",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    {promoActive && (
                      <div
                        style={{
                          position: "absolute",
                          top: 10,
                          left: 10,
                          background: "#d62828",
                          color: "#fff",
                          fontWeight: "bold",
                          fontSize: 12,
                          padding: "6px 10px",
                          borderRadius: 999,
                          zIndex: 2,
                        }}
                      >
                        Promo
                      </div>
                    )}

                    {cartQty > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          top: 10,
                          right: 10,
                          background: "#111",
                          color: "#fff",
                          fontWeight: "bold",
                          fontSize: 12,
                          padding: "6px 10px",
                          borderRadius: 999,
                          zIndex: 2,
                        }}
                      >
                        x{cartQty}
                      </div>
                    )}

                    <div
                      style={{
                        height: 150,
                        borderRadius: 12,
                        background: "#f6f6f6",
                        border: "1px solid #ededed",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 14,
                        overflow: "hidden",
                        padding: 8,
                      }}
                    >
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          style={{
                            maxWidth: "100%",
                            maxHeight: "100%",
                            objectFit: "contain",
                            display: "block",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            color: "#888",
                            fontSize: 12,
                            fontWeight: "bold",
                          }}
                        >
                          Pas d'image
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        fontWeight: "bold",
                        fontSize: 18,
                        marginBottom: 6,
                        textAlign: "center",
                        minHeight: 44,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {product.name}
                    </div>

                    <div
                      style={{
                        color: "#666",
                        fontSize: 14,
                        textAlign: "center",
                        marginBottom: 6,
                      }}
                    >
                      {product.category ?? "-"}
                    </div>

                    {isAdmin && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          marginBottom: 10,
                        }}
                      >
                        <div
                          style={{
                            background: stockStatus.background,
                            color: stockStatus.color,
                            fontSize: 13,
                            fontWeight: "bold",
                            padding: "6px 10px",
                            borderRadius: 999,
                          }}
                        >
                          {stockStatus.label} • {Number(product.stock_qty || 0).toFixed(0)}
                        </div>
                      </div>
                    )}

                    <div
                      style={{
                        textAlign: "center",
                        marginBottom: 14,
                      }}
                    >
                      {promoActive && product.promo_price !== null && product.promo_price !== undefined ? (
                        <>
                          <div
                            style={{
                              fontSize: 14,
                              color: "#888",
                              textDecoration: "line-through",
                              marginBottom: 4,
                            }}
                          >
                            {Number(product.price).toFixed(2)} €
                          </div>

                          {discountPercent !== null && (
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: "bold",
                                color: "green",
                                marginBottom: 4,
                              }}
                            >
                              -{discountPercent}%
                            </div>
                          )}

                          <div
                            style={{
                              fontWeight: "bold",
                              fontSize: 20,
                              color: "green",
                            }}
                          >
                            {effectivePrice.toFixed(2)} €
                          </div>
                        </>
                      ) : (
                        <div
                          style={{
                            fontWeight: "bold",
                            fontSize: 18,
                          }}
                        >
                          {effectivePrice.toFixed(2)} €
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => addToCart(product)}
                      disabled={isOutOfStock}
                      style={{
                        marginTop: "auto",
                        width: "100%",
                        padding: "14px 12px",
                        borderRadius: 12,
                        border: "none",
                        background: isOutOfStock ? "#bdbdbd" : "#111",
                        color: "#fff",
                        fontWeight: "bold",
                        fontSize: 16,
                        cursor: isOutOfStock ? "not-allowed" : "pointer",
                      }}
                    >
                      {isOutOfStock ? "Rupture de stock" : "Choisir ce produit"}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
          background: "rgba(255,255,255,0.98)",
          borderTop: "1px solid #e5e5e5",
          boxShadow: "0 -6px 24px rgba(0,0,0,0.08)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div
          style={{
            maxWidth: 1400,
            margin: "0 auto",
            padding: 12,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontWeight: "bold", fontSize: 16 }}>
              Sélection : {cartCount} article(s)
            </div>
            <div style={{ color: "#666", fontSize: 14 }}>
              Total : {cartTotal.toFixed(2)} €
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={clearCart}
              disabled={cartCount === 0 || isSubmittingCart}
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid #d8d8d8",
                background: "#fff",
                cursor: cartCount === 0 || isSubmittingCart ? "not-allowed" : "pointer",
                fontWeight: "bold",
                opacity: cartCount === 0 || isSubmittingCart ? 0.6 : 1,
              }}
            >
              Vider
            </button>

            <button
              onClick={validateCart}
              disabled={cartCount === 0 || isSubmittingCart}
              style={{
                padding: "12px 16px",
                borderRadius: 12,
                border: "none",
                background: "#111",
                color: "#fff",
                cursor: cartCount === 0 || isSubmittingCart ? "not-allowed" : "pointer",
                fontWeight: "bold",
                opacity: cartCount === 0 || isSubmittingCart ? 0.6 : 1,
              }}
            >
              {isSubmittingCart ? "Validation..." : "Valider la sélection"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}