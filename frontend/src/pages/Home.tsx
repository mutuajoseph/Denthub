import FeaturedClinics from "../components/home/FeaturedClinics";
import HeroSection from "../components/home/HeroSection";
import HomeStats from "../components/home/HomeStats";
import HowItWorks from "../components/home/HowItWorks";

export default function Home() {
  return (
    <>
      <HeroSection />
      <HowItWorks />
      <HomeStats />
      <FeaturedClinics />
    </>
  );
}
