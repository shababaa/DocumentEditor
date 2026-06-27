import { useCallback, useEffect, useState } from "react";
import * as authApi from "../api/auth.js";
import { AuthContext } from "./authContext.js";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    authApi.getMe()
      .then((nextUser) => {
        if (active) setUser(nextUser);
      })
      .catch((error) => {
        if (active && error.status !== 401) console.error(error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const nextUser = await authApi.login(email, password);
    setUser(nextUser);
    return nextUser;
  }, []);

  const signup = useCallback(async (email, password) => {
    const nextUser = await authApi.signup(email, password);
    setUser(nextUser);
    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
