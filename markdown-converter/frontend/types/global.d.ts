declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme: "outline" | "filled_black" | "filled_blue";
              size: "large" | "medium" | "small";
              text?: "signin_with";
            }
          ) => void;
        };
      };
    };
  }
}

export {};
