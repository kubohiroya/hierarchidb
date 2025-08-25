import { useAppConfig } from '~/contexts/AppConfigContext';

/**
 * Common head tags for all pages
 * Provides favicon and other meta tags
 */
export function AppHead() {
  const { appPrefix, appTitle, appDescription } = useAppConfig();
  
  return (
    <>
      <title>{appTitle}</title>
      {appDescription && (
        <meta name="description" content={appDescription} />
      )}
      <link rel="icon" href={`${appPrefix}favicon.svg`} type="image/svg+xml" />
      {/* PNG favicon as data URL for immediate loading and better compatibility */}
      <link rel="icon" type="image/png" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAA7AAAAOwBeShxvQAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAKhSURBVFiFtZfPaxNBFMc/m91NTNLUVqtQKHgQPIgHL/4DD0LBgxc9ePDkyZMnT548CIIHQfBQLN48ePAgiAcPgiAIgqCIVbGtaWuTJtlkdnZnxkNqsp3Zbhr6hYVh3rz3/bx582ZnBXYhIgJA07R/YmVZRtM0hBBYloUQAtu2kVKiaRpSShzHQdM0HMfBtm2klGiahpQS27axLAtN03Ach2g0iqZpCCGwLIsNm5VSymw2K7PZrJRSSimlzOVyMpfLScdxpOu60nVdKaWUruuGsG1bOo4jHceRtm1Lx3Gk67rSdV3Z6TiO1HVdBvZzXVd2Op12EaqqKl3XbbPneZ7neZ7v+77v+/I/6Ha7XTab3RSPx2N+uBPZto1t2wgh/IsQEYEQIhCXUmJZVgdLKTEMo0MEA8vlcrler9MNq9Vq19pisUi73Q6kjV4ZVFWF4zi+RVRVxXGcTkIIgaqqCCHQNG2TrutYlkU4HEZRFBRF6fQH8TCHhoYAqNfr2LaNoij09PQA0Gq1cByHSCTSMfX392/adyAQGRkZAWBtbY1qtYpt29Trddrt9lZz3yLhcJhyuUy5XKbdbmOaJqZpYprmdsO2xODgIIqiYJomqqqiqiqGYWAYBrquB/K/RTRNo9VqYRgGjuMQjUaJRqOEQiFCoRCKomypOhAIhUIAJBIJEokEAJFIZFs8/1dhGEaIx+MAVCoVADRNIxQKdRJCCCzLwnVdXNft/C4T/7yCaDRKLBajVqtRrVYxTbPz1wPQ29vbh1IjhOhE/v5VFKXrdRAIrF+u6zpCCGzbJhaL0dfXRywWQ1EU4vE4rutSr9exLIsVVVU/ptPp1xsbpFKpL6lU6sv8/Pzi/Pz84vz8fCmVSn0B3mUymeVMJvMGKGUymXKH+wOHEVjLHmWUdAAAAABJRU5ErkJggg==" />
      <link rel="apple-touch-icon" href={`${appPrefix}favicon.svg`} />
    </>
  );
}