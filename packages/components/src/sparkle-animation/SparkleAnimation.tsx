/** @jsxImportSource @emotion/react */
import { useEffect, useState } from 'react';
import { css } from '@emotion/react';

interface SparkleAnimationProps {
  showSparkle: boolean;
  duration?: number;
}

const sparkleStyle = css`
  display: inline-block;
  animation: sparkle 1s infinite alternate;
  @keyframes sparkle {
    0% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(1.2); }
    100% { opacity: 1; transform: scale(1); }
  }
`;

export const SparkleAnimation: React.FC<SparkleAnimationProps> = ({
  showSparkle,
  duration = 5000,
}) => {
  const [isVisible, setIsVisible] = useState(showSparkle);

  useEffect(() => {
    if (showSparkle) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, duration);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      return () => {};
    }
  }, [showSparkle, duration]);

  if (!isVisible) return null;

  return <span css={sparkleStyle}>✨</span>;
}