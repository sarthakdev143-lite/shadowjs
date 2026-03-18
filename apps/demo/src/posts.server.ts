export interface Post {
  id: number;
  title: string;
}

const posts: Post[] = [
  { id: 1, title: "Signals track the exact reader." },
  { id: 2, title: "Compiler-generated RPC removes manual fetch calls." },
  { id: 3, title: "Query invalidation stays string-key simple." }
];

export async function addPost(title: string): Promise<Post> {
  const post = {
    id: posts.length + 1,
    title
  };

  posts.unshift(post);
  return post;
}

export async function getPosts(): Promise<Post[]> {
  return posts.map((post) => ({ ...post }));
}
