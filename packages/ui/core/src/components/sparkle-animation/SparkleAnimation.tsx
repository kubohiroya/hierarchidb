import React, { useEffect, useState } from 'react';
import styles from './SparkleAnimation.module.css';

interface SparkleAnimationProps {
  showSparkle: boolean;
  /**
   * アニメーション時間（ミリ秒）
   * デフォルトは5000ms（5秒）
   */
  duration?: number;
}

export const SparkleAnimation: React.FC<SparkleAnimationProps> = ({
  showSparkle,
  duration = 5000,
}) => {
  const [isVisible, setIsVisible] = useState(showSparkle);

  useEffect(() => {
    // showSparkleがtrueに変わったときだけタイマーを設定
    if (showSparkle) {
      setIsVisible(true);

      // 指定された時間後に非表示にする
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, duration);

      return () => clearTimeout(timer);
    } else {
      // falseになったら即座に非表示
      setIsVisible(false);
      // cleanup関数を明示的に返す
      return () => {
        // No cleanup needed
      };
    }
  }, [showSparkle, duration]);

  if (!isVisible) return null;

  return <span className={styles.sparkle}>✨</span>;
};
