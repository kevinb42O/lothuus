import { notFound } from 'next/navigation';
import { HouseVideoRender } from '@/components/house-video-render';

export default function IntroRender() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <HouseVideoRender />;
}
