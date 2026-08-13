import axios from "axios"
import { API_URL } from "@/lib/config"

export async function getNacionalidades(): Promise<{ id: number; nombre: string }[]> {
  const { data } = await axios.get(`${API_URL}/nacionalidades`)
  return data
}
