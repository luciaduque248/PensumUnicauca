import {
    createContext,
} from "react";

import type {
    AppAccessContextValue,
} from "../types/appAccess";

export const AppAccessContext =
    createContext<
        AppAccessContextValue | undefined
    >(undefined);