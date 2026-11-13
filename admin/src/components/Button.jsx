import { Link } from 'react-router-dom';
import styles from './Button.module.css';

// Renders a router Link when `to` is provided, otherwise a <button>.
export default function Button({ to, variant = 'primary', className = '', children, ...rest }) {
  const classes = `${styles.button} ${styles[variant]} ${className}`.trim();
  if (to) return <Link to={to} className={classes} {...rest}>{children}</Link>;
  return <button className={classes} {...rest}>{children}</button>;
}
