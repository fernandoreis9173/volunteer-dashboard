import React from 'react';
import { icons, IconName } from '../assets/icons';

interface IconProps {
  name: IconName;
  className?: string;
  size?: number | string;
}

/**
 * Componente Icon reutilizável para renderizar ícones SVG
 * 
 * @param name - Nome do ícone a ser renderizado
 * @param className - Classes CSS adicionais
 * @param size - Tamanho do ícone (padrão: h-10 w-10)
 */
const Icon: React.FC<IconProps> = ({ name, className = 'h-10 w-10', size }) => {
  const IconComponent = icons[name];
  
  if (!IconComponent) {
    console.warn(`Ícone "${name}" não encontrado`);
    return null;
  }

  const sizeClasses = size 
    ? { width: size, height: size }
    : {};

  return (
    <IconComponent 
      className={className}
      style={sizeClasses}
      aria-hidden="true"
    />
  );
};

export default Icon;