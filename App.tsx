import CustomerApp from "./customer";
import PartnerApp from "./partner";

export default process.env.EXPO_PUBLIC_APP_ROLE === "partner"
  ? PartnerApp
  : CustomerApp;
