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
  progressText = 'Initializing application...',
}: TitleLogoProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '600px', // Fixed width to prevent text wrapping differences
        height: '280px', // Fixed total height for consistent layout
        justifyContent: 'center',
        marginTop: showProgress ? '-58px' : '0', // Move up 58px for splash screen
      }}
    >
      {/* Logo - no animation to ensure consistent appearance */}
      <div
        style={{
          height: '80px', // Fixed height
          width: '80px', // Fixed width
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
        }}
      >
        <svg
          width="80"
          height="80"
          viewBox="0 0 80 80"
          fill="none"
          style={{
            display: 'block', // Prevent inline spacing issues
          }}
        >
          {/* TreeTypes structure with nodes and connections */}
          {/* Top node */}
          <circle cx="40" cy="15" r="8" fill="#1976d2" />

          {/* Connection lines from top to middle */}
          <line x1="40" y1="23" x2="25" y2="32" stroke="#1976d2" strokeWidth="2" />
          <line x1="40" y1="23" x2="55" y2="32" stroke="#1976d2" strokeWidth="2" />

          {/* Middle nodes */}
          <circle cx="25" cy="40" r="8" fill="#42a5f5" />
          <circle cx="55" cy="40" r="8" fill="#42a5f5" />

          {/* Connection lines from middle to bottom */}
          <line x1="25" y1="48" x2="15" y2="57" stroke="#42a5f5" strokeWidth="2" />
          <line x1="25" y1="48" x2="32" y2="57" stroke="#42a5f5" strokeWidth="2" />
          <line x1="55" y1="48" x2="48" y2="57" stroke="#42a5f5" strokeWidth="2" />
          <line x1="55" y1="48" x2="65" y2="57" stroke="#42a5f5" strokeWidth="2" />

          {/* Bottom nodes */}
          <circle cx="15" cy="65" r="6" fill="#90caf9" />
          <circle cx="32" cy="65" r="6" fill="#90caf9" />
          <circle cx="48" cy="65" r="6" fill="#90caf9" />
          <circle cx="65" cy="65" r="6" fill="#90caf9" />
        </svg>
      </div>

      {/* Title */}
      <h1
        style={{
          fontSize: '48px',
          fontWeight: 400,
          margin: '0',
          marginBottom: '16px',
          color: '#333333',
          fontFamily: 'Roboto, "Helvetica Neue", Arial, sans-serif',
          lineHeight: '1.2',
        }}
      >
        {title}
      </h1>

      {/* Description area - fixed height whether shown or not */}
      <div
        style={{
          height: '24px', // Fixed height for description area
          marginBottom: '32px',
          width: '100%',
        }}
      >
        {!showProgress && (
          <p
            style={{
              fontSize: '16px',
              color: '#666666',
              margin: '0',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontFamily: 'Roboto, "Helvetica Neue", Arial, sans-serif',
              lineHeight: '1.5',
            }}
          >
            {description}
          </p>
        )}
      </div>

      {/* Bottom area - same total height for both modes */}
      <div
        style={{
          height: '66px', // Fixed height for bottom area
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {showProgress ? (
          <>
            {/* Progress bar */}
            <div
              style={{
                width: '300px',
                height: '2px',
                backgroundColor: '#e0e0e0',
                borderRadius: '1px',
                overflow: 'hidden',
                marginBottom: '8px',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: '#1976d2',
                  animation: 'progress 2s ease-in-out infinite',
                }}
              />
            </div>

            {/* Loading text */}
            <p
              style={{
                fontSize: '14px',
                color: '#999999',
                fontStyle: 'italic',
                margin: 0,
                fontFamily: 'Roboto, "Helvetica Neue", Arial, sans-serif',
              }}
            >
              {progressText}
            </p>
          </>
        ) : (
          // Placeholder for top page to maintain same layout
          <div style={{ height: '100%' }} />
        )}
      </div>

      {/* Inline styles for progress animation only */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
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
      `,
        }}
      />
    </div>
  );
}
