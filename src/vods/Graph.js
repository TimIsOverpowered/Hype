/*
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
    fetchVod();*/
