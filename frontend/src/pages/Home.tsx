import FeaturedClinics from "../components/home/FeaturedClinics";
import HeroSection from "../components/home/HeroSection";
import HowItWorks from "../components/home/HowItWorks";
import StatsBar from "../components/home/StatsBar";

export default function Home() {
  return (
    <>
      <HeroSection />
      <StatsBar />
      <HowItWorks />
      <FeaturedClinics />
    </>
  );
}
