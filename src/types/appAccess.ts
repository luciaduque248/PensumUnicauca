export type AppAccessMode =
    | "guest"
    | "authenticated";

export interface AppAccessContextValue {
    accessMode: AppAccessMode;
    accountEmail: string | null;
    leaveCurrentAccess: () => Promise<void>;
    showGuestInformation: () => Promise<void>;
}