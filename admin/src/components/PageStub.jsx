import styles from './PageStub.module.css';

// Temporary body for admin modules scheduled for later phases.
export default function PageStub({ title, note = 'This page will be built in a later phase.' }) {
  return (
    <section className={`container ${styles.stub}`}>
      <h1>{title}</h1>
      <p>{note}</p>
    </section>
  );
}
