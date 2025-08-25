interface TitleLogoProps {
  title?: string;
  description?: string;
  showProgress?: boolean;
  progressText?: string;
}

export function TitleLogo({ 
  title = 'HierarchiDB',
  description = 'High-performance tree-structured data management framework',
  showProgress = false,
  progressText = 'Initializing application...'
}: TitleLogoProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: '600px',  // Fixed width to prevent text wrapping differences
      height: '280px', // Fixed total height for consistent layout
      justifyContent: 'center',
      marginTop: showProgress ? '-58px' : '0', // Move up 58px for splash screen
    }}>
      {/* Logo - no animation to ensure consistent appearance */}
      <div style={{
        height: '80px',  // Fixed height
        width: '80px',   // Fixed width
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '24px',
      }}>
        <svg 
          width="80" 
          height="80" 
          viewBox="0 0 24 24" 
          fill="#1976d2"
          style={{
            display: 'block',  // Prevent inline spacing issues
          }}
        >
          <path d="M2 20h20v-4H2m18-2h2v-4h-2m-2 0v4h-2v-4h-2v4h-2v-4h-2v4H10v-4H8v4H6v-4H4v4H2V6h2v4h2V6h2v4h2V6h2v4h2V6h2v4h2V6h2v4h2V6h2v8z"/>
        </svg>
      </div>
      
      {/* Title */}
      <h1 style={{
        fontSize: '48px',
        fontWeight: 400,
        margin: '0',
        marginBottom: '16px',
        color: '#333333',
        fontFamily: 'Roboto, "Helvetica Neue", Arial, sans-serif',
        lineHeight: '1.2',
      }}>
        {title}
      </h1>
      
      {/* Description area - fixed height whether shown or not */}
      <div style={{
        height: '24px',  // Fixed height for description area
        marginBottom: '32px',
        width: '100%',
      }}>
        {!showProgress && (
          <p style={{
            fontSize: '16px',
            color: '#666666',
            margin: '0',
            textAlign: 'center',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontFamily: 'Roboto, "Helvetica Neue", Arial, sans-serif',
            lineHeight: '1.5',
          }}>
            {description}
          </p>
        )}
      </div>
      
      {/* Bottom area - same total height for both modes */}
      <div style={{
        height: '66px',  // Fixed height for bottom area
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {showProgress ? (
          <>
            {/* Progress bar */}
            <div style={{
              width: '300px',
              height: '2px',
              backgroundColor: '#e0e0e0',
              borderRadius: '1px',
              overflow: 'hidden',
              marginBottom: '8px',
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                backgroundColor: '#1976d2',
                animation: 'progress 2s ease-in-out infinite',
              }}/>
            </div>
            
            {/* Loading text */}
            <p style={{
              fontSize: '14px',
              color: '#999999',
              fontStyle: 'italic',
              margin: 0,
              fontFamily: 'Roboto, "Helvetica Neue", Arial, sans-serif',
            }}>
              {progressText}
            </p>
          </>
        ) : (
          // Placeholder for top page to maintain same layout
          <div style={{ height: '100%' }} />
        )}
      </div>
      
      {/* Inline styles for progress animation only */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes progress {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}} />
    </div>
  );
}