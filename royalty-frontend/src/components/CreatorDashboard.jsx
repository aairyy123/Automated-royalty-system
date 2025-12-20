export default function CreatorDashboard({ account }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    fetch(`http://localhost:4000/creator/${account}`)
      .then(res => res.json())
      .then(setItems);
  }, [account]);

  return (
    <div>
      <h2>Creator Dashboard</h2>
      {items.map(i => (
        <div key={i.cid}>
          <p>CID: {i.cid}</p>
          <p>Earned: {i.total_earned}</p>
        </div>
      ))}
    </div>
  );
}
