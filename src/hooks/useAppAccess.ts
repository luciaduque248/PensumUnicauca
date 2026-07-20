import {
    useContext,
} from "react";

import {
    AppAccessContext,
} from "../context/AppAccessContext";

import type {
    AppAccessContextValue,
} from "../types/appAccess";

export const useAppAccess =
    (): AppAccessContextValue => {
        const context =
            useContext(
                AppAccessContext,
            );

        if (!context) {
            throw new Error(
                "useAppAccess debe utilizarse dentro de ApplicationAccessGate.",
            );
        }

        return context;
    };