import { useEffect, useState } from "react";
import client from "../client";

export default function Graph(props) {
  const { vodId } = props;
  const [vod, setVod] = useState(undefined);

  useEffect(() => {
    const fetchVod = async () => {
      const { accessToken } = await client.get("authentication");
      await fetch(`https://api.hype.lol/vods/${vodId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      })
        .then((response) => response.json())
        .then((response) => {
          if (response.code >= 400) return;
          setVod(response);
        })
        .catch((e) => {
          console.error(e);
        });
    };
    fetchVod();
  }, []);

  if (!vod)
    return (
      <>
        <></>
      </>
    );
}
