"use client"

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://rjtplbbnwyqmyxrvvhbk.supabase.co"
const supabaseKey = "sb_publishable_WPJ4qqX91a9A1Qh9PhdIVA_D3CsnueK"

export const supabase = createClient(supabaseUrl, supabaseKey)