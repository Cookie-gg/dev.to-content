if (!process.env.DEVTO_KEY || !process.env.FILES) {
  throw new Error("DEVTO_KEY and FILES env variables are required");
}

import glob from "glob";
import * as fs from "fs";
import axios from "axios";
import * as util from "util";

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

interface Post {
  id: number;
  slug: string;
}

const BASE_URL = "https://dev.to/api/articles";

glob(`../${process.env.FILES}`, async (_, files) => {
  if (files.length < 1) return;

  // get unpublished all posts
  const { data: unpublishedPosts } = await axios.get<Post[]>(
    `${BASE_URL}/me/unpublished`,
    { headers: { "api-key": `${process.env.DEVTO_KEY}` } }
  );

  await Promise.all(
    // loop through all files
    files.map(async (file) => {
      const data = await readFile(file, "utf8");
      const [, rest, body] = data.split("---\n");
      const metaData: Record<string, string> = Object.assign(
        {},
        ...rest
          .split("\n")
          .filter((_) => !!_)
          .map((str) => {
            const [key, ...rest] = str.split(/\s*:\s*/);

            return { [key]: rest.join(":") };
          })
      );
      if ("slug" in metaData || !("published" in metaData && "id" in metaData))
        return;

      if (metaData.published === "false") {
        const post = unpublishedPosts.find(
          ({ id }) => id === Number(metaData.id)
        );
        if (!post) return;

        metaData.slug = post.slug + "/edit";
      } else {
        const { data: post } = await axios.get<Post>(
          `${BASE_URL}/${metaData.id}`
        );
        metaData.slug = post.slug;
      }
      const newData = [
        "",
        Object.entries(metaData)
          .map(([key, value]) => `${key}: ${value}\n`)
          .join(""),
        body,
      ].join("---\n");
      await writeFile(file, newData, "utf8");
    })
  );
});
