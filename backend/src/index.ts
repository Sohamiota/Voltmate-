import app from './app';

const port = parseInt(process.env.PORT || '8081', 10);
app.listen(port, () => {
  console.log(`server listening on ${port}`);
});

