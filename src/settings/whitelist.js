import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Box, Divider, Paper, Typography, IconButton, TextField, Alert } from '@mui/material';
import { getToken } from '../auth.js';
import ClearIcon from '@mui/icons-material/Clear';
import SendIcon from '@mui/icons-material/Send';

function useUser() {
  return useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const token = getToken();
      if (!token) return null;
      const res = await fetch('https://api.hype.lol/v1/user/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return res.json();
    },
  });
}

export default function Whitelist() {
  const queryClient = useQueryClient();
  const { data: user } = useUser();
  const [whitelistInput, setWhitelistInput] = useState('');
  const [clicked, setClicked] = useState(false);
  const [success, setSuccess] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const whitelists = user?.whitelists ?? [];

  const whitelistMutation = useMutation({
    mutationFn: (username) => {
      const accessToken = getToken();
      return fetch('https://api.hype.lol/v1/whitelist/channel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ username }),
      });
    },
    onSuccess: async (response) => {
      const data = await response.json();
      if (data.error) {
        console.error(data.message);
        setSuccess(false);
        setErrorMsg(data.message);
      } else {
        setSuccess(true);
        setErrorMsg('');
        queryClient.invalidateQueries({ queryKey: ['user'] });
      }
    },
    onError: (e) => {
      console.error(e.message || e);
      setSuccess(false);
      setErrorMsg(e.message || 'Server encountered an error..');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (channel) => {
      const accessToken = getToken();
      const res = await fetch('https://api.hype.lol/v1/whitelist/channel', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ username: channel }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to delete');
      }
      return res.json();
    },
    onSuccess: (_data, channel) => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
    onError: (err) => {
      console.error(err);
    },
  });

  if (!user) return <></>;

  const status = (user.patreon && user.patreon.tier >= 1 && user.patreon.isPatron) || user.whitelist || user.admin;

  const handleWhitelist = () => {
    if (!status || whitelistMutation.isPending) return;
    setClicked(true);
    whitelistMutation.mutate(whitelistInput);
    setTimeout(() => setClicked(false), 3000);
  };

  return (
    <div>
      <Typography variant='h5' fontWeight={500}>
        Whitelist
      </Typography>
      <Paper elevation={1} sx={{ mt: 2, mb: 4, border: '1px solid hsla(0,0%,100%,.1)' }}>
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', flexWrap: 'nowrap', mb: 1, alignItems: 'center' }}>
            <Info>Whitelists</Info>
            <Data>{`${user.whitelists.length}/${user.max_whitelist_channels}`}</Data>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', flexWrap: 'nowrap', mb: 1, alignItems: 'center' }}>
            <Info>Whitelist a Channel</Info>
            <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
              {success === false && (
                <Alert sx={{ mb: 2, width: '100%' }} severity='error'>
                  {errorMsg}
                </Alert>
              )}
              <Box sx={{ display: 'flex' }}>
                <TextField
                  disabled={!status}
                  autoCapitalize='off'
                  autoComplete='off'
                  autoCorrect='off'
                  label='Whitelist a Channel'
                  variant='outlined'
                  onChange={(evt) => setWhitelistInput(evt.target.value)}
                />
                <IconButton
                  color={success === true ? 'success' : success === false ? 'error' : 'primary'}
                  disabled={!status || clicked}
                  onClick={handleWhitelist}
                  variant='contained'
                >
                  <SendIcon color='inherit' size='small' />
                </IconButton>
              </Box>
            </Box>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center' }}>
            <Info>Whitelisted</Info>
            <Box>
              <List whitelists={whitelists} deleteMutation={deleteMutation} />
            </Box>
          </Box>
          <Divider sx={{ mb: 2 }} />
        </Box>
      </Paper>
    </div>
  );
}

const List = ({ whitelists, deleteMutation }) => {
  const handleDelete = (whitelist) => {
    const confirmation = window.confirm(`Are you sure you want to delete ${whitelist.channel} from your whitelist?`);
    if (!confirmation) return;
    deleteMutation.mutate(whitelist.channel);
  };

  return whitelists.filter(Boolean).map((whitelist) => (
    <Box key={whitelist.id} sx={{ display: 'flex', alignItems: 'center' }}>
      <Typography variant='body2'>{whitelist.channel}</Typography>
      <IconButton onClick={() => handleDelete(whitelist)} variant='contained'>
        <ClearIcon color='primary' size='small' />
      </IconButton>
    </Box>
  ));
};

const Info = (props) => (
  <Box sx={{ width: '15rem', flexShrink: 0, pr: 1.5 }}>
    <Box sx={{ mb: 0.2 }}>
      <Typography variant='h6' fontWeight={600} {...props}></Typography>
    </Box>
  </Box>
);

const Data = (props) => (
  <Box sx={{ display: 'flex', alignItems: 'center' }}>
    <Typography variant='body2' {...props}></Typography>
  </Box>
);
