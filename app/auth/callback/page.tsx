"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "../../../lib/supabase-browser"

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    const handleAuth = async () => {
      await supabase.auth.getSession()
      router.replace("/")
    }

    handleAuth()
  }, [router])

  return <p style={{ padding: 20 }}>Connexion...</p>
}