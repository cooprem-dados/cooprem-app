
import React from 'react';

const Logo: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => {
  return (
    <img 
      src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS2YbN6y1YSvCB-uBp2Pz_Dp5t4VeVei16jGg&s"
      alt="Logo Sicoob"
      className={className}
      style={{ height: '40px', objectFit: 'contain', ...style }}
    />
  );
};

export default Logo;
