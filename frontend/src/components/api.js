// src/components/api.js
import axios from "axios";
import { BASE_URL } from "../config";

export const api = axios.create({
  baseURL: BASE_URL, // already includes /api/v1
  headers: {
    "Content-Type": "application/json",
  },
});
