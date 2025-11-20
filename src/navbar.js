import React, { useState } from "react";
import { AppBar, Toolbar, Box, Button, TextField } from "@mui/material";
import client from "./client.js";
import Logo from "./assets/logo.svg";
import CustomLink from "./utils/CustomLink.js";
import TwitterIcon from "@mui/icons-material/Twitter";
import SvgIcon from "@mui/material/SvgIcon";
import { useNavigate, useLocation } from "react-router-dom";
import LoginIcon from "@mui/icons-material/Login";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const socials = [
  {
    path: `https://discord.gg/chUMEPR`,
    icon: (
      <SvgIcon viewBox="0 0 71 55" color="primary">
        <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2532 53.6986 30.1693C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z" />
      </SvgIcon>
    ),
  },
  {
    path: `https://twitter.com/overpowered`,
    icon: <TwitterIcon color="primary" />,
  },
  {
    path: `https://patreon.com/join/overpoweredgg`,
    icon: (
      <SvgIcon viewBox="0 -4.5 256 256" color="primary">
        <path d="M45.1355837,0 L45.1355837,246.35001 L0,246.35001 L0,0 L45.1355837,0 Z M163.657111,0 C214.65668,0 256,41.3433196 256,92.3428889 C256,143.342458 214.65668,184.685778 163.657111,184.685778 C112.657542,184.685778 71.3142222,143.342458 71.3142222,92.3428889 C71.3142222,41.3433196 112.657542,0 163.657111,0 Z" />
      </SvgIcon>
    ),
  },
  {
    path: `https://ko-fi.com/overpoweredgg`,
    icon: (
      <SvgIcon viewBox="0 0 24 24" color="primary">
        <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311zm6.173.478c-.928.116-1.682.028-1.682.028V7.284h1.77s1.971.551 1.971 2.638c0 1.913-.985 2.667-2.059 3.015z" />
      </SvgIcon>
    ),
  },
];

export default function Navbar(props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = props;
  const [channelInput, setChannelInput] = useState("");

  const handleSubmit = (e) => {
    if (e.which === 13 && channelInput.length > 0) {
      navigate(`/${channelInput}`);
    }
  };

  return (
    <Box sx={{ flex: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Box sx={{ display: "flex", alignItems: "center", flex: 1 }}>
            {location.pathname !== "/" && (
              <Box sx={{ mr: 2 }}>
                <Button size="small" onClick={() => navigate(-1)} variant="contained" startIcon={<ArrowBackIcon />}>
                  Back
                </Button>
              </Box>
            )}

            <Box sx={{ mr: 2 }}>
              <CustomLink href={"/#"}>
                <img alt="" style={{ maxWidth: "65px", height: "auto" }} src={Logo} />
              </CustomLink>
            </Box>

            {socials.map(({ path, icon }) => (
              <Box key={path} sx={{ mr: 2 }}>
                <CustomLink href={path} rel="noopener noreferrer" target="_blank">
                  {icon}
                </CustomLink>
              </Box>
            ))}
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
            <TextField label="Enter a Twitch channel" size="small" type="text" onKeyDown={handleSubmit} onChange={(e) => setChannelInput(e.target.value)} />
          </Box>

          {user && (
            <Box sx={{ display: "flex", justifyContent: "end", alignItems: "center", flex: 1 }}>
              <Box sx={{ mr: 2 }}>
                <Button size="small" disabled={location.pathname.startsWith("/settings")} onClick={() => navigate("/settings")} variant="contained" startIcon={<SettingsIcon />}>
                  Settings
                </Button>
              </Box>
              <Button size="small" onClick={() => client.logout()} variant="contained" startIcon={<LogoutIcon />}>
                Log Out
              </Button>
            </Box>
          )}

          {!user && (
            <Box sx={{ display: "flex", justifyContent: "end", alignItems: "center", flex: 1 }}>
              <Box sx={{ mr: 2 }}>
                <Button size="small" href="https://api.hype.lol/oauth/twitch?redirect=electron" rel="noopener noreferrer" target="_blank" variant="contained" startIcon={<LoginIcon />}>
                  Login
                </Button>
              </Box>
            </Box>
          )}
        </Toolbar>
      </AppBar>
    </Box>
  );
}
