import Image from "next/image";

export default async function Home() {
  const posts = await fetch('http://localhost:3000/api/post').then(res => res.json())
  console.log(posts)
  return (
    <>
    </>
  );
}
