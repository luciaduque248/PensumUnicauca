import {
    useContext,
} from "react";

import {
    AuthContext,
} from "../context/AuthContext";

import type {
    AuthContextValue,
} from "../types/auth";

export const useAuth =
    (): AuthContextValue => {
        const context =
            useContext(AuthContext);

        if (!context) {
            throw new Error(
                "useAuth debe utilizarse dentro de AuthProvider.",
            );
        }

        return context;
    };