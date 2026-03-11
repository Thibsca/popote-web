"use client"

import { useEffect, useState } from "react"
import { createClient } from "../lib/supabase-browser"

export default function Home() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState<string | null>(null)
  const [message, setMessage] = useState("Chargement...")

  useEffect(() => {
    const init = async () => {
      try {
        const url = new URL(window.location.href)
        const code = url.searchParams.get("code")

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            setMessage("Erreur échange session : " + error.message)
            setLoading(false)
            return
          }

          url.searchParams.delete("code")
          window.history.replaceState({}, "", url.pathname)
        }

        const { data, error } = await supabase.auth.getUser()

        if (error) {
          setMessage("Erreur getUser : " + error.message)
          setLoading(false)
          return
        }

        const currentEmail = data.user?.email ?? null
        setEmail(currentEmail)
        setLoading(false)
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "Erreur inconnue"
        setMessage("Erreur : " + errorMessage)
        setLoading(false)
      }
    }

    init()
  }, [supabase])

  const login = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
    })

    if (error) {
      setMessage("Erreur connexion Google : " + error.message)
    }
  }

  const logout = async () => {
    const { error } = await supabase.auth.signOut()

    if (error) {
      setMessage("Erreur déconnexion : " + error.message)
      return
    }

    setEmail(null)
  }

  if (loading) {
    return (
      <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
        {message}
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
    <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
      <h1>POPOTE</h1>
      <p>Connecté : <strong>{email}</strong></p>

      <button
        onClick={logout}
        style={{
          padding: "12px 16px",
          borderRadius: 12,
          border: "1px solid #d8d8d8",
          background: "#fff",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        Se déconnecter
      </button>
    </div>
  )
}
