import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getAuthBootstrap } from "@/api/auth.api";
import type { AuthState } from "./types";

const initialState: AuthState = {
  user: null,
  status: "idle",
  error: null,
};

export const fetchAuthBootstrap = createAsyncThunk(
  "auth/fetchBootstrap",
  async () => {
    const response = await getAuthBootstrap();
    return response.data.user;
  },
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearAuthState: (state) => {
      state.user = null;
      state.status = "unauthenticated";
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAuthBootstrap.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchAuthBootstrap.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = action.payload ? "authenticated" : "unauthenticated";
        state.error = null;
      })
      .addCase(fetchAuthBootstrap.rejected, (state, action) => {
        state.status = "error";
        state.error = action.error.message || "Failed to load auth bootstrap";
      });
  },
});

export const { clearAuthState } = authSlice.actions;
export default authSlice.reducer;
