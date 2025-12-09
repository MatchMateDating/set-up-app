import { API_BASE_URL } from '@env';
import { Platform } from "react-native";

export const BASE_URL =
  Platform.OS === "android"
    ? API_BASE_URL.replace("localhost", "10.0.2.2").replace("http://192.168.0.116:5000", "10.0.2.2")
    : API_BASE_URL;

