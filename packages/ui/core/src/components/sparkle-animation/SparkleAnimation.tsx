import React, { useEffect, useState } from 'react';
import styles from './SparkleAnimation.module.css';

interface SparkleAnimationProps {
  showSparkle: boolean;
  /**
         * 5000ms5
      */
  duration?: number;
}

export const SparkleAnimation: React.FC<SparkleAnimationProps> = ({
                                                                    showSparkle,
                                                                    duration = 5000,
                                                                  }) => {
  const [isVisible, setIsVisible] = useState(showSparkle);

  useEffect(() => {
    //  showSparkletrue
    if (showSparkle) {
      setIsVisible(true);

      const timer = setTimeout(() => {
        setIsVisible(false);
      }, duration);

      return () => clearTimeout(timer);
    } else {
      //  false
      setIsVisible(false);
      //  cleanup
      return () => {
        // No cleanup needed
      };
    }
  }, [showSparkle, duration]);

  if (!isVisible) return null;

  return <span className={styles.sparkle}>✨</span>;
};
