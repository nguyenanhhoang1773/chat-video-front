import dynamic from "next/dynamic";
const Page = dynamic(() => import("./components/homePage"), { ssr: false });
export default Page;
